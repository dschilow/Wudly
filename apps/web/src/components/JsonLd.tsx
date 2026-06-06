/**
 * Renders one or more Schema.org JSON-LD objects as <script> tags. Server
 * component — the JSON is serialized at render time and never touched on the
 * client, so it adds zero runtime cost while making pages machine-readable.
 */
export function JsonLd({ data }: { data: unknown | unknown[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Schema.org payloads are our own trusted, serialized objects.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
