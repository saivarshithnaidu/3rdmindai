async function run() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  const data = await res.json();
  const geminiModels = data.data.filter(m => m.id.includes('gemini'));
  console.log("Gemini models on OpenRouter:", geminiModels.map(m => ({ id: m.id, name: m.name })));
}
run();
