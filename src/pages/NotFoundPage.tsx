export default function NotFoundPage() {
  return (
    <div className="notfound">
      <img
        className="notfound__illustration"
        src="/images/page-not-found-illustration.png"
        alt=""
        width={534}
        height={587}
        decoding="async"
      />
      <div className="notfound__copy">
        <h1 className="notfound__title">Page not found</h1>
        <div className="notfound__details">
          <p className="notfound__text">
            Oops! It seems this page didn&apos;t make it here.
            <br />
            Try another route to find what you&apos;re looking for.
          </p>
          <p className="notfound__code">Error 404</p>
        </div>
      </div>
    </div>
  );
}
