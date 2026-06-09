import axios from 'axios';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_APP_ID = process.env.META_APP_ID;

export const metaApiService = {
  /**
   * Resolves a Facebook Page URL to its numeric Page ID via Graph API
   */
  async getMetaPageId(facebookUrl: string): Promise<string> {
    if (!META_ACCESS_TOKEN) {
      console.warn('Meta credentials not configured. Using mock Meta page ID.');
      try {
        const u = new URL(facebookUrl);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0] || 'mock_meta_page_id';
      } catch {
        return 'mock_meta_page_id';
      }
    }

    try {
      const urlObj = new URL(facebookUrl);
      const pageName = urlObj.pathname.split('/').filter(Boolean)[0];
      
      const response = await axios.get(`https://graph.facebook.com/${pageName}`, {
        params: {
          fields: 'id,name',
          access_token: META_ACCESS_TOKEN
        }
      });
      
      return response.data?.id || '';
    } catch (err: any) {
      console.error('Meta API getMetaPageId error:', err.message || err);
      // Clean fallback from URL string hash
      return 'mock_' + Math.abs(facebookUrl.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)).toString();
    }
  },

  /**
   * Fetches active ads from Meta Ad Library archive for the specified page ID
   */
  async searchMetaAdLibrary(metaPageId: string, competitorId: string): Promise<any[]> {
    if (!META_ACCESS_TOKEN) {
      console.warn('Meta credentials not configured. Returning mock/simulated Meta ads.');
      // Create diverse mock dataset
      return [
        {
          id: `meta_${competitorId}_1`,
          ad_creative_bodies: ["Struggling with manual developer environment setup? 3RDMIND automates your workspace setups instantly. Join the waitlist!"],
          ad_creative_link_titles: ["Setup Dev Environments Instantly"],
          ad_creative_link_captions: ["3rdmind.ai"],
          ad_creative_link_descriptions: ["Get your team working in under 5 minutes instead of 5 days."],
          ad_delivery_start_time: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          ad_snapshot_url: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=400&h=300&q=80",
          impressions: { lower_bound: 10000, upper_bound: 50000 },
          spend: { lower_bound: 100, upper_bound: 500 },
          publisher_platforms: ["facebook", "instagram"],
          ad_creative_link_button_text: "LEARN_MORE"
        },
        {
          id: `meta_${competitorId}_2`,
          ad_creative_bodies: ["Stop wasting time building mockups by hand. Our AI assistant handles designs, wireframes, and database schemas in minutes."],
          ad_creative_link_titles: ["Next-Gen Design System Orchestrator"],
          ad_creative_link_captions: ["3rdmind.ai/design"],
          ad_creative_link_descriptions: ["Generate standard React and Tailwind layouts automatically."],
          ad_delivery_start_time: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          ad_snapshot_url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&h=300&q=80",
          impressions: { lower_bound: 5000, upper_bound: 10000 },
          spend: { lower_bound: 50, upper_bound: 100 },
          publisher_platforms: ["facebook", "instagram", "messenger"],
          ad_creative_link_button_text: "SIGN_UP"
        },
        {
          id: `meta_${competitorId}_3`,
          ad_creative_bodies: ["Cut cloud bills by 40% with our smart resources auto-scaler. Setup takes 2 minutes. Free trial."],
          ad_creative_link_titles: ["40% Off Cloud Auto-Scaler"],
          ad_creative_link_captions: ["3rdmind.ai/pricing"],
          ad_creative_link_descriptions: ["Stop paying for idle dev instances."],
          ad_delivery_start_time: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
          ad_snapshot_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&h=300&q=80",
          impressions: { lower_bound: 20000, upper_bound: 100000 },
          spend: { lower_bound: 200, upper_bound: 1000 },
          publisher_platforms: ["facebook", "audience_network"],
          ad_creative_link_button_text: "GET_OFFER"
        }
      ];
    }

    try {
      const response = await axios.get('https://graph.facebook.com/v19.0/ads_archive', {
        params: {
          access_token: META_ACCESS_TOKEN,
          ad_reached_countries: 'IN,US,GB,AE',
          search_page_ids: metaPageId,
          ad_active_status: 'ACTIVE',
          fields: 'id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_delivery_start_time,ad_snapshot_url,impressions,spend,publisher_platforms,ad_creative_link_button_text',
          limit: 50
        }
      });
      return response.data?.data || [];
    } catch (err: any) {
      console.error('Meta API ads_archive fetch error:', err.response?.data || err.message || err);
      throw err;
    }
  }
};

export default metaApiService;
