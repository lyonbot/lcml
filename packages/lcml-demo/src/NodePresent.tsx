import * as React from 'preact';
import { useCallback, useContext, useMemo, useState } from 'preact/hooks';
import { LCMLNodeInfo } from 'lcml';
import "./NodePresent.css"

export const ActiveNode = React.createContext<LCMLNodeInfo | null>(null);

// import {javascript} from "@codemirror/lang-javascript"
export const NodePresent = (props: {
  node: LCMLNodeInfo;
  parents?: LCMLNodeInfo[];
  onMouseMove: (node: LCMLNodeInfo) => void;
  onClick: (node: LCMLNodeInfo) => void;
  onMouseLeave: (node: LCMLNodeInfo) => void;
}) => {
  const { node } = props;
  const isHovering = useContext(ActiveNode) === node;
  const pTree = useMemo(() => [...props.parents || [], node], [node, props.parents]);

  const handleMouseMove = useCallback((ev: MouseEvent) => {
    ev.stopPropagation();
    props.onMouseMove(node);
  }, [node, props.onMouseMove]);

  const handleClick = useCallback((ev: MouseEvent) => {
    ev.stopPropagation();
    props.onClick(node);
  }, [node, props.onClick]);

  const handleMouseLeave = useCallback((ev: MouseEvent) => {
    ev.stopPropagation();
    props.onMouseLeave(node);
  }, [node, props.onMouseLeave]);

  return <div className={"np-node " + (isHovering ? 'isHovering ' : '')}
    onMouseMove={handleMouseMove}
    onMouseLeave={handleMouseLeave}
    onClick={handleClick}
  >
    <div className="np-title">
      <span className="np-type">{node.type}</span>
      {node.key}
    </div>
    {
      !!node.children?.length &&
      <div className="np-children">
        {node.children.map(subNode => <NodePresent {...props} node={subNode} parents={pTree} />)}
      </div>
    }
  </div>;
};
