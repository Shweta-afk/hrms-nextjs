import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md">
      <img src="/axiotta-hrms.png" alt="Axiotta HRMS" className="h-8 w-auto object-contain" />
    </Link>
  );
}
