import { redirect } from 'next/navigation'
import Script from 'next/script'

const SWAGGER_UI_CSS = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'
const SWAGGER_UI_BUNDLE = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'
const SWAGGER_UI_PRESET = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js'

export const metadata = {
  title: 'Aletheia API Docs',
}

export default function DocsPage() {
  const isEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true'

  if (!isEnabled) {
    redirect('/')
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href={SWAGGER_UI_CSS} />
      <div id="swagger-ui" />
      <Script src={SWAGGER_UI_BUNDLE} strategy="beforeInteractive" />
      <Script src={SWAGGER_UI_PRESET} strategy="beforeInteractive" />
      <Script
        id="swagger-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            (function init() {
              if (typeof SwaggerUIBundle === 'undefined') {
                setTimeout(init, 100);
                return;
              }
              SwaggerUIBundle({
                url: '/api/docs',
                dom_id: '#swagger-ui',
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIStandalonePreset
                ],
                layout: 'StandaloneLayout',
                deepLinking: true,
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
              })
            })()
          `,
        }}
      />
    </>
  )
}
