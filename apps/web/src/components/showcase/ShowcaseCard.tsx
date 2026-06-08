import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import { PROFESSIONAL_PROFILE_TYPE_LABEL, type ShowcaseSummaryDto } from '@wudly/shared';
import { DisclosureBadge } from '@/components/DisclosureBadge';

/**
 * Teaser card for a published Showcase. Used on the product page (Showcase
 * section) and the creator profile. Always carries the disclosure label so the
 * commercial nature is visible before opening.
 */
export function ShowcaseCard({
  showcase,
  href,
  showProduct = false,
}: {
  showcase: ShowcaseSummaryDto;
  href: string;
  showProduct?: boolean;
}) {
  return (
    <Link href={href} className="press card-elevated block overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
              <span className="font-medium text-label">{showcase.profile.displayName}</span>
              <span>·</span>
              <span>{PROFESSIONAL_PROFILE_TYPE_LABEL[showcase.profile.type]}</span>
            </div>
            <h3 className="mt-1 text-balance text-[1.0625rem] font-bold leading-tight tracking-tight text-label">
              {showProduct && showcase.product ? showcase.product.canonicalName : showcase.title}
            </h3>
            {showcase.subtitle && (
              <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-muted-foreground">
                {showcase.subtitle}
              </p>
            )}
          </div>
          <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-label-3" strokeWidth={2.2} aria-hidden />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DisclosureBadge type={showcase.disclosureType} />
          <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
            <Layers className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
            {showcase.blockCount} Abschnitte
          </span>
        </div>
      </div>
    </Link>
  );
}
