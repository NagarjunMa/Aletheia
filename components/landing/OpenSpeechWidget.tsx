import Script from "next/script";

export const OPENSPEECH_WIDGET_URL =
  "https://widget.openspeechai.com/widgets/chat-widget.js?widgetId=69a6b2ed-1302-4ee5-974f-c340eab71b90";

export default function OpenSpeechWidget() {
  return (
    <Script
      id="openspeech-ai-chat-widget"
      src={OPENSPEECH_WIDGET_URL}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
