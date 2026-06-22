import { BulbTips } from "../icons";

export default function ProTips({
  badge,
  onExplore,
  extra,
}: {
  badge: string;
  onExplore: () => void;
  extra?: { title: string; body: string; onAdd: () => void };
}) {
  return (
    <div className="protips-col">
      <div className="protips">
        <span className="protips__badge">{badge}</span>
        <h3 className="protips__title">Pro Tips</h3>
        <p className="protips__body">
          Explore best practices how to improve your chances of passing screening
        </p>
        <button className="protips__explore" onClick={onExplore}>
          Explore ›
        </button>
        <div className="protips__bulb">
          <BulbTips size={120} />
        </div>
      </div>

      {extra && (
        <div className="protips-extra">
          <h3 className="protips-extra__title">{extra.title}</h3>
          <p className="protips-extra__body">{extra.body}</p>
          <button className="protips-extra__add" onClick={extra.onAdd}>
            + Add section
          </button>
        </div>
      )}
    </div>
  );
}
