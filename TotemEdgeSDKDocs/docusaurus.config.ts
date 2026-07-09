import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import siteConfig from './site.config';

const config: Config = {
  title: siteConfig.title,
  tagline: siteConfig.tagline,
  favicon: 'img/favicon.ico',

  url: siteConfig.url,
  baseUrl: siteConfig.baseUrl,

  organizationName: siteConfig.organizationName,
  projectName: siteConfig.projectName,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  markdown: {
    format: 'detect',
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: undefined,
        },
        blog: false,
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        ...(siteConfig.analyticsId
          ? {
              gtag: {
                trackingID: siteConfig.analyticsId,
                anonymizeIP: true,
              },
            }
          : {}),
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/totem-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Totem Edge SDK',
      logo: {
        alt: 'Totem Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'conceptsSidebar',
          position: 'left',
          label: 'Concepts',
        },
        {
          type: 'docSidebar',
          sidebarId: 'guidesSidebar',
          position: 'left',
          label: 'Example Apps',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API Reference',
        },
        {
          href: 'https://axia.minima.global/docs',
          label: 'Axia Docs',
          position: 'right',
        },
        {
          href: 'https://github.com/totem-network',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Concepts', to: '/concepts/agent-policy-overview' },
            { label: 'Example Apps', to: '/guides/tessa-pay' },
            { label: 'API Reference', to: '/api' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Minima Network', href: 'https://minima.global' },
            { label: 'Totem Extension', href: 'https://totem.minima.global' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Axia Platform', href: 'https://axia.minima.global' },
            { label: 'GitHub', href: 'https://github.com/totem-network' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Totem Network. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'bash', 'json'],
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;
