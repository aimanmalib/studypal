import { Fragment, type ReactNode } from 'react';

/**
 * Fill `{name}` placeholders with React nodes, e.g. a <strong> inside a
 * translated sentence, without splitting the sentence across keys.
 */
export function rich(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name && name in nodes ? nodes[name] : part}</Fragment>;
  });
}
