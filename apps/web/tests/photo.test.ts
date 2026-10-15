// The CV photo (Personal info → Photo): what the button accepts, how the picture is cropped, and
// what the server agrees to store (only the small JPEG the builder makes, never a link).
import { describe, it, expect } from "vitest";
import { photoError, squareCrop, MAX_PHOTO_CHARS } from "@/lib/photo";
import { cvDataSchema } from "@/lib/validators";
import { emptyCvData } from "@/lib/types";

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

describe("photo button", () => {
  it("points a CV file to Improve My Resume instead of failing silently", () => {
    expect(photoError(file("CV Ana Popescu.pdf", "application/pdf"))).toBe("CV_FILE");
    expect(photoError(file("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe("CV_FILE");
    expect(photoError(file("cv.doc", "application/msword"))).toBe("CV_FILE");
    expect(photoError(file("cv.txt", "text/plain"))).toBe("CV_FILE");
  });

  it("takes pictures, and nothing else", () => {
    expect(photoError(file("me.jpg", "image/jpeg"))).toBeNull();
    expect(photoError(file("me.png", "image/png"))).toBeNull();
    expect(photoError(file("me.webp", "image/webp"))).toBeNull();
    expect(photoError(file("data.bin", "application/octet-stream"))).toBe("NOT_IMAGE");
    expect(photoError(file("huge.jpg", "image/jpeg", 21 * 1024 * 1024))).toBe("TOO_LARGE");
  });

  it("crops a portrait a little above its middle, a landscape in the middle", () => {
    expect(squareCrop(800, 1000)).toEqual({ side: 800, sx: 0, sy: 60 });
    expect(squareCrop(1000, 800)).toEqual({ side: 800, sx: 100, sy: 0 });
    expect(squareCrop(500, 500)).toEqual({ side: 500, sx: 0, sy: 0 });
  });
});

describe("the stored photo", () => {
  const withPhoto = (photo: string) => {
    const d = emptyCvData();
    d.personalInfo.photo = photo;
    return cvDataSchema.safeParse(d).success;
  };

  it("is empty or a JPEG data URL", () => {
    expect(withPhoto("")).toBe(true);
    expect(withPhoto("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==")).toBe(true);
  });

  it("is never a link the PDF renderer would fetch, another format, or a huge blob", () => {
    expect(withPhoto("https://tracker.example/pixel.jpg")).toBe(false);
    expect(withPhoto("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(withPhoto("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
    expect(withPhoto(`data:image/jpeg;base64,${"A".repeat(MAX_PHOTO_CHARS)}`)).toBe(false);
  });
});
