import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import SlackProvider from 'next-auth/providers/slack';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { supabaseService } from '../../../../services/supabase.service';
import { encrypt } from '../../../../lib/crypto';
import { ALL_CONNECTORS } from '../../../../lib/connectors.registry';

const PROVIDER_TO_SLUGS: Record<string, string[]> = {
  google: ['google-drive', 'gmail', 'google-calendar'],
  slack: ['slack'],
  github: ['github'],
  notion: ['notion'],
  linear: ['linear'],
  atlassian: ['jira'],
  azuread: ['outlook', 'onedrive'],
  hubspot: ['hubspot'],
  salesforce: ['salesforce'],
  dropbox: ['dropbox'],
  discord: ['discord'],
  asana: ['asana']
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'mock-google-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock-google-secret',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    }),
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID || 'mock-slack-id',
      clientSecret: process.env.SLACK_CLIENT_SECRET || 'mock-slack-secret',
      authorization: {
        params: {
          scope: 'channels:read chat:write files:read users:read'
        }
      }
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || 'mock-github-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'mock-github-secret',
      authorization: {
        params: { scope: 'repo read:user read:org' }
      }
    }),
    // Notion as custom provider to avoid version import errors
    {
      id: 'notion',
      name: 'Notion',
      type: 'oauth',
      authorization: 'https://api.notion.com/v1/oauth/authorize?owner=user',
      token: 'https://api.notion.com/v1/oauth/token',
      userinfo: 'https://api.notion.com/v1/users/me',
      profile(profile: any) {
        return {
          id: profile.bot_id || 'notion-bot',
          name: profile.workspace_name || 'Notion Workspace',
          email: ''
        };
      },
      clientId: process.env.NOTION_CLIENT_ID || 'mock-notion-id',
      clientSecret: process.env.NOTION_CLIENT_SECRET || 'mock-notion-secret'
    },
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID || 'mock-microsoft-id',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'mock-microsoft-secret',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      authorization: {
        params: {
          scope: 'openid email profile offline_access Mail.Read Mail.Send Files.ReadWrite Calendars.ReadWrite'
        }
      }
    }),
    // Custom OAuth Providers
    {
      id: 'linear',
      name: 'Linear',
      type: 'oauth',
      authorization: {
        url: 'https://linear.app/oauth/authorize',
        params: { scope: 'read write issues:create' }
      },
      token: 'https://api.linear.app/oauth/token',
      userinfo: 'https://api.linear.app/v1/viewer',
      profile(profile: any) {
        return {
          id: profile.id || profile.data?.viewer?.id || 'linear-user',
          name: profile.name || profile.data?.viewer?.name || 'Linear User',
          email: profile.email || profile.data?.viewer?.email || ''
        };
      },
      clientId: process.env.LINEAR_CLIENT_ID || 'mock-linear-id',
      clientSecret: process.env.LINEAR_CLIENT_SECRET || 'mock-linear-secret'
    },
    {
      id: 'atlassian',
      name: 'Atlassian',
      type: 'oauth',
      authorization: {
        url: 'https://auth.atlassian.com/authorize',
        params: {
          audience: 'api.atlassian.com',
          scope: 'read:jira-work write:jira-work offline_access',
          prompt: 'consent'
        }
      },
      token: 'https://auth.atlassian.com/oauth/token',
      userinfo: 'https://api.atlassian.com/me',
      profile(profile: any) {
        return {
          id: profile.accountId || 'atlassian-user',
          name: profile.displayName || 'Atlassian User',
          email: profile.emailAddress || ''
        };
      },
      clientId: process.env.ATLASSIAN_CLIENT_ID || 'mock-atlassian-id',
      clientSecret: process.env.ATLASSIAN_CLIENT_SECRET || 'mock-atlassian-secret'
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      type: 'oauth',
      authorization: {
        url: 'https://app.hubspot.com/oauth/authorize',
        params: {
          scope: 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read'
        }
      },
      token: 'https://api.hubapi.com/oauth/v1/token',
      userinfo: 'https://api.hubapi.com/oauth/v1/access-tokens/me',
      profile(profile: any) {
        return {
          id: String(profile.user || profile.hub_id || 'hubspot-user'),
          name: profile.user || 'HubSpot User',
          email: profile.user || ''
        };
      },
      clientId: process.env.HUBSPOT_CLIENT_ID || 'mock-hubspot-id',
      clientSecret: process.env.HUBSPOT_CLIENT_SECRET || 'mock-hubspot-secret'
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      type: 'oauth',
      authorization: {
        url: 'https://login.salesforce.com/services/oauth2/authorize',
        params: { scope: 'api refresh_token' }
      },
      token: 'https://login.salesforce.com/services/oauth2/token',
      userinfo: 'https://login.salesforce.com/services/oauth2/userinfo',
      profile(profile: any) {
        return {
          id: profile.user_id || 'salesforce-user',
          name: profile.name || 'Salesforce User',
          email: profile.email || ''
        };
      },
      clientId: process.env.SALESFORCE_CLIENT_ID || 'mock-salesforce-id',
      clientSecret: process.env.SALESFORCE_CLIENT_SECRET || 'mock-salesforce-secret'
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      type: 'oauth',
      authorization: {
        url: 'https://www.dropbox.com/oauth2/authorize',
        params: {
          token_access_type: 'offline',
          scope: 'files.content.read files.content.write'
        }
      },
      token: 'https://api.dropboxapi.com/oauth2/token',
      userinfo: 'https://api.dropboxapi.com/2/users/get_current_account',
      profile(profile: any) {
        return {
          id: profile.account_id || 'dropbox-user',
          name: profile.name?.display_name || 'Dropbox User',
          email: profile.email || ''
        };
      },
      clientId: process.env.DROPBOX_CLIENT_ID || 'mock-dropbox-id',
      clientSecret: process.env.DROPBOX_CLIENT_SECRET || 'mock-dropbox-secret'
    },
    {
      id: 'discord',
      name: 'Discord',
      type: 'oauth',
      authorization: {
        url: 'https://discord.com/api/oauth2/authorize',
        params: { scope: 'bot messages.read' }
      },
      token: 'https://discord.com/api/oauth2/token',
      userinfo: 'https://discord.com/api/users/@me',
      profile(profile: any) {
        return {
          id: profile.id || 'discord-user',
          name: profile.username || 'Discord User',
          email: profile.email || ''
        };
      },
      clientId: process.env.DISCORD_CLIENT_ID || 'mock-discord-id',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || 'mock-discord-secret'
    },
    {
      id: 'asana',
      name: 'Asana',
      type: 'oauth',
      authorization: {
        url: 'https://app.asana.com/-/oauth_authorize',
        params: { scope: 'default' }
      },
      token: 'https://app.asana.com/-/oauth_token',
      userinfo: 'https://app.asana.com/api/1.0/users/me',
      profile(profile: any) {
        return {
          id: profile.data?.gid || 'asana-user',
          name: profile.data?.name || 'Asana User',
          email: profile.data?.email || ''
        };
      },
      clientId: process.env.ASANA_CLIENT_ID || 'mock-asana-id',
      clientSecret: process.env.ASANA_CLIENT_SECRET || 'mock-asana-secret'
    }
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.provider = account.provider;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.provider = token.provider;
      session.expiresAt = token.expiresAt;
      return session;
    },
    async signIn({ user, account }) {
      if (!account) return true;
      
      const provider = account.provider;
      const slugs = PROVIDER_TO_SLUGS[provider] || [provider];
      
      const supabase = supabaseService.getServiceClient();
      const userId = '00000000-0000-0000-0000-000000000000';
      
      for (const slug of slugs) {
        const config = ALL_CONNECTORS.find((c: any) => c.slug === slug);
        if (!config) continue;
        
        const expiresAt = account.expires_at 
          ? new Date(Number(account.expires_at) * 1000).toISOString()
          : account.expires_in
            ? new Date(Date.now() + Number(account.expires_in) * 1000).toISOString()
            : null;

        const encryptedAccessToken = account.access_token ? encrypt(account.access_token) : null;
        const encryptedRefreshToken = account.refresh_token ? encrypt(account.refresh_token) : null;

        const { error } = await supabase.from('connectors').upsert({
          user_id: userId,
          slug: slug,
          name: config.name,
          category: config.category,
          auth_type: 'oauth',
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expiry: expiresAt,
          scopes: account.scope ? account.scope.split(/[\s,]+/) : config.scopes || [],
          is_active: true,
          server_url: config.serverUrl,
          metadata: {
            provider: provider,
            scopes_granted: account.scope || ''
          }
        }, {
          onConflict: 'user_id,slug'
        });
        
        if (error) {
          console.error(`Failed to upsert connector ${slug} on NextAuth callback:`, error.message);
        }
      }
      
      return true;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || '3rdmind-nextauth-secret-fallback'
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
