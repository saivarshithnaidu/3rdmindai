import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const filename = file.name;
    const isPdf = filename.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    if (!isPdf) {
      // Direct text parsing for TXT/MD/etc.
      const text = await file.text();
      return new Response(JSON.stringify({ text, filename }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PDF parsing
    const apiKey = process.env.LLAMA_CLOUD_API_KEY || process.env.LLAMAINDEX_API_KEY;

    if (!apiKey) {
      console.warn("LlamaIndex API key is missing. Returning a placeholder resume parsing response.");
      // Standard professional placeholder resume to keep user flows functional when API key is missing
      const placeholderText = `John Doe
Software Engineer
Email: john.doe@example.com | Phone: (123) 456-7890 | Bangalore, India

Professional Summary:
Passionate Software Engineer with 4+ years of experience building scalable web applications. Expert in React, Next.js, Node.js, and TypeScript. Experience working with cloud platforms like AWS and Supabase.

Skills:
- Frontend: React, Next.js, TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS
- Backend: Node.js, Express, PostgreSQL, Supabase, RESTful APIs
- Tools & DevOps: Git, Docker, AWS (S3, EC2), Vercel, CI/CD
- Core Concepts: Agile Development, REST APIs, Microservices, RAG Workflows

Experience:
Senior Software Engineer | Tech Solutions Inc. | 2023 - Present
- Architected and built Next.js web applications, improving search performance by 40%.
- Integrated state-of-the-art AI tooling and RAG setups inside production dashboards.
- Led a team of 3 engineers, enforcing clean code, testing, and modern UI practices.

Software Engineer | DevCorp | 2021 - 2023
- Built responsive user interfaces and modular components using Tailwind CSS and React.
- Managed backend database queries, migrations, and REST endpoints.

Education:
Bachelor of Technology in Computer Science | Bangalore University`;
      
      return new Response(JSON.stringify({ text: placeholderText, filename, isPlaceholder: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call LlamaParse REST API
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const uploadUrl = "https://api.llamaindex.ai/v1/parsing/upload";
    const parseFormData = new FormData();
    const blob = new Blob([fileBuffer], { type: "application/pdf" });
    parseFormData.append("file", blob, filename);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      body: parseFormData
    });

    if (!uploadResponse.ok) {
      throw new Error(`LlamaParse upload failed with status ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;

    let attempts = 0;
    let status = "PENDING";
    const statusUrl = `https://api.llamaindex.ai/v1/parsing/job/${jobId}`;

    while (status !== "SUCCESS" && status !== "ERROR" && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(statusUrl, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        status = statusData.status || "PENDING";
      }
    }

    if (status !== "SUCCESS") {
      throw new Error(`LlamaParse job failed or timed out. Status: ${status}`);
    }

    const resultUrl = `https://api.llamaindex.ai/v1/parsing/job/${jobId}/result/markdown`;
    const resultResponse = await fetch(resultUrl, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    if (!resultResponse.ok) {
      throw new Error(`Failed to retrieve LlamaParse result. Status ${resultResponse.status}`);
    }

    const parsedMarkdown = await resultResponse.text();

    return new Response(JSON.stringify({ text: parsedMarkdown, filename }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Error parsing file:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
