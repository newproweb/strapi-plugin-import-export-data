import React, { useEffect, useRef } from "react";

const LOG_STYLE = {
  maxHeight: 220,
  minHeight: 100,
  overflowY: "auto",
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.5,
  padding: 12,
  borderRadius: 4,
  backgroundColor: "#0f0f17",
  border: "1px solid #2a2a36",
};

const LINE_STYLE = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const colorFor = (stream) => (stream === "stderr" ? "#ff9d9d" : "#c8f6c8");

const LogPanel = ({ lines = [] }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);

  return (
    <div ref={ref} style={LOG_STYLE}>
      {lines.length === 0 && <div style={{ color: "#888" }}>Waiting for CLI output…</div>}
      {lines.map((l, i) => (
        <div key={i} style={{ ...LINE_STYLE, color: colorFor(l.stream) }}>
          {l.line}
        </div>
      ))}
    </div>
  );
};

export default LogPanel;
