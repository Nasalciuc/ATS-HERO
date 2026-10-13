"use client";
export default function NotFoundPage() {
  return (
    <div className="notfound" data-figma="notfound">
      <img
        className="notfound__illustration"
        data-figma="notfound-image"
        src="/images/page-not-found-illustration.png"
        alt=""
        width={534}
        height={587}
        decoding="async"
      />
      <div className="notfound__copy" data-figma="notfound-copy">
        <h1 className="notfound__title" data-figma="notfound-title">
          Page not found
        </h1>
        <div className="notfound__details">
          <p className="notfound__text" data-figma="notfound-text">
            Oops! It seems this page didn&apos;t make it here.
            <br />
            Try another route to find what you&apos;re looking for.
          </p>
          <p className="notfound__code" data-figma="notfound-code">
            Error 404
          </p>
        </div>
      </div>
    </div>
  );
}
