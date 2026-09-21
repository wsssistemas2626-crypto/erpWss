import { messages } from './messages';

export function App() {
  return (
    <main>
      <h1>{messages.appName}</h1>
      <p>{messages.shellPlaceholder}</p>
    </main>
  );
}
