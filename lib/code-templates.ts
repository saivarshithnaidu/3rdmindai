import { CodeTemplate } from '../types/coding';

export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'nextjs-saas',
    name: 'Next.js SaaS Starter',
    description: 'Full Next.js 15 app with Supabase auth, Stripe payments, dashboard, and landing page',
    stack: ['Next.js 15', 'Supabase', 'Stripe', 'Tailwind CSS'],
    files: 24,
    icon: 'ti-brand-nextjs'
  },
  {
    id: 'express-api',
    name: 'Express REST API',
    description: 'Complete REST API with auth, CRUD, validation, and tests',
    stack: ['Node.js', 'Express', 'PostgreSQL', 'Jest'],
    files: 12,
    icon: 'ti-brand-nodejs'
  },
  {
    id: 'react-dashboard',
    name: 'React Dashboard',
    description: 'Admin dashboard with charts, tables, and auth',
    stack: ['React', 'Recharts', 'Tailwind CSS'],
    files: 15,
    icon: 'ti-brand-react'
  },
  {
    id: 'python-api',
    name: 'FastAPI Python API',
    description: 'FastAPI with SQLAlchemy, Alembic migrations, and pytest',
    stack: ['Python', 'FastAPI', 'SQLAlchemy', 'PostgreSQL'],
    files: 14,
    icon: 'ti-brand-python'
  },
  {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    description: 'Python Telegram bot with commands, webhooks, and DB',
    stack: ['Python', 'python-telegram-bot', 'PostgreSQL'],
    files: 8,
    icon: 'ti-brand-telegram'
  },
  {
    id: 'chrome-extension',
    name: 'Chrome Extension',
    description: 'Complete Chrome extension with popup, content script, background',
    stack: ['JavaScript', 'Chrome APIs', 'HTML/CSS'],
    files: 10,
    icon: 'ti-brand-chrome'
  },
  {
    id: 'discord-bot',
    name: 'Discord Bot',
    description: 'Discord.js bot with slash commands and database',
    stack: ['Node.js', 'Discord.js', 'MongoDB'],
    files: 9,
    icon: 'ti-brand-discord'
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Complete HTML/CSS/JS landing page with animations',
    stack: ['HTML', 'CSS', 'JavaScript', 'Tailwind CSS'],
    files: 5,
    icon: 'ti-world'
  }
];
