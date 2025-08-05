// Added GA4 + Google Ads Conversion Tracking + Google Tag Manager integration
import fs from 'fs';
import path from 'path';
import https from 'https';
import fetch from 'node-fetch';

export async function updateSitemap(products) {
  const baseUrl = 'https://auroza.com';
  const urls = [`${baseUrl}/`, `${baseUrl}/shop`];
  products.forEach(product => {
    urls.push(`${baseUrl}/product/${product.id}`);
  });

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.map(url => `<url><loc>${url}</loc></url>`).join('\n')}
  </urlset>`;

  fs.writeFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), sitemapContent);

  updateProductFeed(products, baseUrl);
  pingSearchEngines(`${baseUrl}/sitemap.xml`);
  await syncToMetaCommerce(products);
}

function pingSearchEngines(sitemapUrl) {
  const googlePing = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  const bingPing = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

  [googlePing, bingPing].forEach(pingUrl => {
    https.get(pingUrl, res => console.log(`Pinged: ${pingUrl} - Status: ${res.statusCode}`))
         .on('error', err => console.error(`Failed to ping ${pingUrl}:`, err.message));
  });
}

function updateProductFeed(products, baseUrl) {
  const feedItems = products.map(product => `
    <item>
      <g:id>${product.id}</g:id>
      <g:title><![CDATA[${product.name}]]></g:title>
      <g:description><![CDATA[${product.description}]]></g:description>
      <g:link>${baseUrl}/product/${product.id}</g:link>
      <g:image_link>${product.image}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${product.price} INR</g:price>
      <g:brand>AUROZA</g:brand>
    </item>`).join('\n');

  const feedContent = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
      <title>AUROZA Product Feed</title>
      <link>${baseUrl}</link>
      <description>AUROZA luxury perfumes and attars</description>
      ${feedItems}
    </channel>
  </rss>`;

  fs.writeFileSync(path.join(process.cwd(), 'public', 'product-feed.xml'), feedContent);
}

async function syncToMetaCommerce(products) {
  const metaAccessToken = process.env.META_COMMERCE_ACCESS_TOKEN;
  const catalogId = process.env.META_CATALOG_ID;

  for (const product of products) {
    await fetch(`https://graph.facebook.com/v17.0/${catalogId}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${metaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        retailer_id: product.id,
        name: product.name,
        description: product.description,
        url: `https://auroza.com/product/${product.id}`,
        image_url: product.image,
        price: `${product.price} INR`,
        availability: 'in stock',
        brand: 'AUROZA'
      })
    }).then(res => res.json()).then(data => console.log(`Synced product ${product.id} to Meta Commerce:`, data))
      .catch(err => console.error(`Meta Commerce sync failed for product ${product.id}:`, err));
  }
}

// Tracking Scripts Component with GTM
export function TrackingScripts() {
  return (
    <>
      {/* Google Tag Manager */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-ZZZZZZZ');
      ` }} />
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-ZZZZZZZ" height="0" width="0" style={{display:'none',visibility:'hidden'}}></iframe></noscript>

      {/* Facebook Pixel */}
      <script dangerouslySetInnerHTML={{ __html: `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', 'YOUR_PIXEL_ID');
        fbq('track', 'PageView');
      ` }} />
      <noscript><img height="1" width="1" style={{display:'none'}} src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"/></noscript>
    </>
  );
}

// Facebook CAPI (server-side)
export async function sendServerSideEvent(eventName, eventData) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID;
  await fetch(`https://graph.facebook.com/v17.0/${pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: 'https://auroza.com',
        user_data: eventData.user_data,
        custom_data: eventData.custom_data
      }],
      access_token: accessToken
    })
  }).then(res => res.json()).then(data => console.log(`CAPI Event Sent: ${eventName}`, data))
    .catch(err => console.error(`CAPI Event Failed: ${eventName}`, err));
}

import { productsData } from '../sharedData';
updateSitemap(productsData);

fs.writeFileSync(path.join(process.cwd(), 'public', 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: https://auroza.com/sitemap.xml`);
