import { ScraperConfig } from '../types';

export const SCRAPER_CONFIGS: ScraperConfig[] = [
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Find local businesses, restaurants, agencies, offices',
    icon: 'ti-map-pin',
    queryPlaceholder: 'digital agencies in Mumbai',
    columns: [
      { key: 'name', label: 'Business', type: 'text' },
      { key: 'rating', label: 'Rating', type: 'text' },
      { key: 'reviews', label: 'Reviews', type: 'number' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'category', label: 'Category', type: 'text' }
    ],
    maxResults: 50
  },
  {
    id: 'google-search',
    name: 'Google Search',
    description: 'Search any topic, find websites, news, research',
    icon: 'ti-brand-google',
    queryPlaceholder: 'SaaS tools for agencies 2025',
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'url', label: 'URL', type: 'url' },
      { key: 'snippet', label: 'Description', type: 'text' }
    ],
    maxResults: 30
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    description: 'Find products, competitors, tools in any category',
    icon: 'ti-rocket',
    queryPlaceholder: 'AI agent tools',
    columns: [
      { key: 'name', label: 'Product', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'upvotes', label: 'Upvotes', type: 'number' },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'launched', label: 'Launched', type: 'date' }
    ],
    maxResults: 30
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'Search tweets, find conversations, track topics',
    icon: 'ti-brand-x',
    queryPlaceholder: 'AI agents startup 2025',
    columns: [
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'handle', label: 'Handle', type: 'text' },
      { key: 'content', label: 'Tweet', type: 'text' },
      { key: 'likes', label: 'Likes', type: 'number' },
      { key: 'retweets', label: 'Retweets', type: 'number' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'url', label: 'URL', type: 'url' }
    ],
    maxResults: 50
  },
  {
    id: 'ycombinator',
    name: 'Y Combinator',
    description: 'Find YC companies, startups, founders',
    icon: 'ti-building-skyscraper',
    queryPlaceholder: 'AI developer tools',
    columns: [
      { key: 'name', label: 'Company', type: 'text' },
      { key: 'batch', label: 'Batch', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'tags', label: 'Tags', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' }
    ],
    maxResults: 30
  },
  {
    id: 'generic',
    name: 'Any Website',
    description: 'Open any URL and extract information from it',
    icon: 'ti-world',
    queryPlaceholder: 'https://competitor.com/pricing',
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'metaDesc', label: 'Description', type: 'text' },
      { key: 'fullText', label: 'Text Content', type: 'text' },
      { key: 'url', label: 'URL', type: 'url' }
    ],
    maxResults: 1
  }
];
