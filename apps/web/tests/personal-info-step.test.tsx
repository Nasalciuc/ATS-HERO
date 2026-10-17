// Personal info → Photo through the real step (views/builder/steps.tsx), run the way AppContext runs
// it: a photo that finishes loading after the user typed, or after the user left the step, lands in
// the CV it was picked for and keeps what was typed; once another CV is open, it is dropped.
//
// No DOM here: PersonalInfoStep uses no hooks, so calling it returns its element tree, and the test
// calls the handlers React would attach (a field's onChange, PhotoUpload's onPick and onRemove).
import { describe, it, expect } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { PersonalInfoStep } from "@/views/builder/steps";
import { PhotoUpload } from "@/views/builder/PhotoUpload";
import { applyCvPatch, laterUpdate, type CvPatch } from "@/lib/cv-patch";
import { emptyCvData } from "@/lib/types";

const PHOTO = "data:image/jpeg;base64,AAAA";

/** The builder as AppContext keeps it: patches merged by applyCvPatch, a new generation per CV. */
function builder() {
  const state = { data: emptyCvData(), generation: 0 };
  const update = (patch: CvPatch) => {
    state.data = applyCvPatch(state.data, patch);
  };
  const updateLater = () => laterUpdate(update, () => state.generation);
  return {
    state,
    /** One render of the step, with the data of that moment. */
    render: () => PersonalInfoStep({ data: state.data, update, updateLater, framed: true }),
    /** AppContext's reset or openCv. */
    openAnotherCv: () => {
      state.generation++;
      state.data = emptyCvData();
    },
  };
}

type Props = Record<string, unknown>;

function find(node: ReactNode, match: (el: ReactElement<Props>) => boolean): ReactElement<Props> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isValidElement<Props>(node)) return undefined;
  if (match(node)) return node;
  return find(node.props.children as ReactNode, match);
}

function photo(tree: ReactNode) {
  const el = find(tree, (e) => e.type === PhotoUpload);
  if (!el) throw new Error("Personal info has no PhotoUpload");
  return el.props as unknown as { onPick: () => (photo: string) => void; onRemove: () => void };
}

function field(tree: ReactNode, figma: string) {
  const el = find(tree, (e) => e.props.figma === figma);
  if (!el) throw new Error(`Personal info has no ${figma}`);
  return el.props as unknown as { onChange: (value: string) => void };
}

describe("Personal info, a photo that takes a moment to load", () => {
  it("keeps the name typed while it loaded", () => {
    const b = builder();
    const deliver = photo(b.render()).onPick(); // the pick starts on this render
    field(b.render(), "field-name").onChange("Ana Popescu"); // typed on a later one
    deliver(PHOTO);
    expect(b.state.data.personalInfo).toMatchObject({ name: "Ana Popescu", photo: PHOTO });
  });

  it("still lands in the CV when the user has left the step", () => {
    const b = builder();
    const deliver = photo(b.render()).onPick();
    // Next step: nothing renders Personal info any more
    deliver(PHOTO);
    expect(b.state.data.personalInfo.photo).toBe(PHOTO);
  });

  it("is dropped once another CV is open", () => {
    const b = builder();
    const deliver = photo(b.render()).onPick();
    b.openAnotherCv();
    deliver(PHOTO);
    expect(b.state.data.personalInfo.photo ?? "").toBe("");
  });

  it("can be removed", () => {
    const b = builder();
    photo(b.render()).onPick()(PHOTO);
    photo(b.render()).onRemove();
    expect(b.state.data.personalInfo.photo).toBe("");
  });
});
