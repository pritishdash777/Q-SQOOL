import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { normalizeChatMarkdown } from "@/lib/q-ai-format";
import styles from "./q-ai.module.css";

/** Safe Markdown and math rendering: model output is never treated as HTML. */
export default function ChatText({ text }: { text: string }) {
  return <div className={styles.text}>
    <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {normalizeChatMarkdown(text)}
    </Markdown>
  </div>;
}
