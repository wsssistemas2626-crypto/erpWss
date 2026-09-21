import { messages } from '@erp/web-shell';

export function HomePage() {
  return (
    <section>
      <h1>{messages.appName}</h1>
      <p>{messages.shellPlaceholder}</p>
    </section>
  );
}
