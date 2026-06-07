import crypto from 'crypto';
import supabaseService from './supabase.service';
import { WebhookConfig } from '../types';

export const webhookService = {
  async fireWebhook(projectId: string, event: string, data: any): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    try {
      // Fetch active outbound webhook configs for this project
      const { data: configs, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('project_id', projectId)
        .eq('direction', 'outbound')
        .eq('is_active', true);

      if (error || !configs || configs.length === 0) {
        return;
      }

      // Filter configs that are subscribed to this event
      const subscribedConfigs = configs.filter((config: WebhookConfig) => {
        return config.events && config.events.includes(event);
      });

      if (subscribedConfigs.length === 0) {
        return;
      }

      const timestamp = new Date().toISOString();
      const payload = {
        event,
        data,
        timestamp,
        projectId
      };

      const payloadStr = JSON.stringify(payload);

      // Fire and forget - don't await the fetch calls
      subscribedConfigs.forEach((config) => {
        if (!config.url) return;

        const signature = crypto
          .createHmac('sha256', config.secret || '')
          .update(payloadStr)
          .digest('hex');

        fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
            'x-webhook-secret': config.secret || '' // also supply the secret for standard verification if needed
          },
          body: payloadStr
        })
          .then((res) => {
            if (!res.ok) {
              console.warn(`Outbound webhook to ${config.url} returned status ${res.status}`);
            }
          })
          .catch((err) => {
            console.error(`Failed to dispatch outbound webhook to ${config.url}:`, err);
          });
      });
    } catch (err) {
      console.error(`Error in fireWebhook for event ${event}:`, err);
    }
  }
};

export default webhookService;
