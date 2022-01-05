import * as React from 'preact';
import { useCallback, useContext, useMemo } from 'preact/hooks';
import { ParsedNode, ParsedNodeBase } from 'lcml';
import './NodePresent.css';

export const ActiveNode = React.createContext<ParsedNodeBase | null>(null);

const FakeNodePresent = (props: {
  title?: string | React.VNode;
  type?: string;
  children?: React.ComponentChildren;
  className?: string;
}) => (
  <div className={'np-node isFake'}>
    <div className={'np-title ' + (props.className || '')}>
      <span className="np-type">{props.type || '---'}</span>
      {props.title}
    </div>

    {props.children}
  </div>
);

export const LocRange = (props: { start: number; end?: number }) => {
  const start = props.start;
  const end = props.end ?? start;
  const suffix = end === start ? '' : `~${end}`;
  return (
    <span className="np-loc-range">
      {start}
      {suffix}
    </span>
  );
};

// import {javascript} from "@codemirror/lang-javascript"
export const NodePresent = (props: {
  node: ParsedNode;
  title?: string | React.VNode;
  parents?: ParsedNode[];
  onMouseMove: (node: ParsedNode) => void;
  onClick: (node: ParsedNode) => void;
  onMouseLeave: (node: ParsedNode) => void;
}) => {
  const { node } = props;
  const isHovering = useContext(ActiveNode) === node;
  const pTree = useMemo(() => [...(props.parents || []), node], [node, props.parents]);

  const handleMouseMove = useCallback(
    (ev: MouseEvent) => {
      ev.stopPropagation();
      props.onMouseMove(node);

      const target = ev.currentTarget as HTMLDivElement;
      const scrolling = target.closest('.nodeTreeView')!;
      const scw = scrolling.clientWidth

      let desiring = null as number | null

      const { left, right } = target.getBoundingClientRect();
      if (left <= 10 && (ev.clientX < scw * 0.3 || ev.clientX > right - scw * 0.3)) {
        desiring = Math.min(0, scrolling.scrollLeft + left - 10)
      }
      if (left > scw * 0.2 && ev.clientX > scw * 0.6) {
        desiring = Math.max(0, scrolling.scrollLeft + left - 10)
      }

      if (desiring !== null) {
        scrolling.scrollLeft = (scrolling.scrollLeft * 4 + desiring) / 5
      }
    },
    [node, props.onMouseMove],
  );

  const handleClick = useCallback(
    (ev: MouseEvent) => {
      ev.stopPropagation();
      props.onClick(node);
    },
    [node, props.onClick],
  );

  const handleMouseLeave = useCallback(
    (ev: MouseEvent) => {
      ev.stopPropagation();
      props.onMouseLeave(node);
    },
    [node, props.onMouseLeave],
  );

  return (
    <div
      className={'np-node ' + (isHovering ? 'isHovering ' : '')}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-type={node.type}
    >
      <div className="np-title">
        <span className="np-type">{node.type}</span>
        {props.title}
      </div>

      {node.type === 'object' && (
        <div className="named-box" name="properties">
          {node.properties.map((property, index) => (
            <NodePresent {...props} node={property} title={String(index)} parents={pTree} />
          ))}
        </div>
      )}

      {node.type === 'object-property' && (
        <>
          <div className="named-box" name="key">
            <NodePresent {...props} node={node.key} title="" parents={pTree} />
          </div>
          <div className="named-box" name="value">
            {node.value ? (
              <NodePresent {...props} node={node.value} title="" parents={pTree} />
            ) : (
              <FakeNodePresent title="(null)" />
            )}
          </div>
        </>
      )}

      {node.type === 'array' && (
        <div className="named-box" name="items">
          {node.items.map((item, index) => {
            const loc = node.itemsLocation[index]!;
            const title = (
              <>
                {index}
                {'  '}
                <LocRange start={loc.valueStart} end={loc.valueEnd} />
              </>
            );
            return item ? (
              <NodePresent {...props} node={item} title={title} parents={pTree} />
            ) : (
              <FakeNodePresent title={title} />
            );
          })}
        </div>
      )}
    </div>
  );
};
