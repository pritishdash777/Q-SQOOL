import styles from "./q-ai.module.css";

/** Render the supported text/code formatting as React nodes; never execute model HTML. */
export default function ChatText({ text }: { text: string }) {
  return <div className={styles.text}>{text.split(/(```[\s\S]*?(?:```|$))/g).map((block, index) => {
    if (block.startsWith("```")) {
      const code = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
      return <pre key={index} className={styles.code}><code>{code}</code></pre>;
    }
    return <span key={index}>{block.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part)}</span>;
  })}</div>;
}
