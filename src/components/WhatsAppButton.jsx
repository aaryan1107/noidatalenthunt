import { whatsappUrl } from "../data/contact";

export default function WhatsAppButton() {
  return (
    <a
      className="whatsapp-float"
      href={whatsappUrl("Hi Noida Talent Hunt, I have a question about NTH S2.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Noida Talent Hunt on WhatsApp"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3.2a12.8 12.8 0 0 0-11.1 19.2L3.2 28.8l6.6-1.7A12.8 12.8 0 1 0 16 3.2Zm0 23.4a10.6 10.6 0 0 1-5.4-1.5l-.4-.2-4 1.1 1.1-3.9-.3-.4a10.6 10.6 0 1 1 9 5Zm5.8-8c-.3-.1-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-1.8-.9-3-2.1-3.8-3.7-.2-.3 0-.5.1-.7l.5-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3.1 1.3 3.3c.2.2 2.2 3.4 5.4 4.7.8.3 1.3.5 1.8.7.8.2 1.4.2 2 .1.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4Z" />
      </svg>
      <span>Chat with us</span>
    </a>
  );
}
