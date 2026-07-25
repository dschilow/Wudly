import type { CatalogQualityIssueDto, CatalogQualityItemDto, ProductStatus } from '@wudly/shared';

export interface CatalogQualityInput {
  productId: string;
  canonicalName: string;
  status: ProductStatus;
  brand: string | null;
  categoryId: string | null;
  description: string | null;
  specs: unknown;
  hasImage: boolean;
  sourceCount: number;
  experienceCount: number;
  createdAt: Date;
}

export function calculateCatalogQuality(input: CatalogQualityInput): CatalogQualityItemDto {
  const issues: CatalogQualityIssueDto[] = [];
  const name = input.canonicalName.trim();
  const nameOk =
    name.length >= 4 && !/\b(test|e2e|unknown|unbekannt|produktname|placeholder)\b/i.test(name);
  const descriptionLength = input.description?.trim().length ?? 0;
  const specCount = countSpecs(input.specs);
  const sourceCount = Math.max(0, input.sourceCount);
  const experienceCount = Math.max(0, input.experienceCount);

  let score = 0;
  if (nameOk) score += 15;
  else issues.push(issue('SUSPICIOUS_NAME', 'Produktname prüfen', 'CRITICAL'));

  if (input.brand?.trim()) score += 8;
  else issues.push(issue('MISSING_BRAND', 'Marke fehlt', 'WARNING'));

  if (input.categoryId) score += 12;
  else issues.push(issue('MISSING_CATEGORY', 'Kategorie fehlt', 'WARNING'));

  if (descriptionLength >= 80) score += 15;
  else if (descriptionLength >= 40) {
    score += 8;
    issues.push(issue('SHORT_DESCRIPTION', 'Beschreibung ist sehr kurz', 'WARNING'));
  } else {
    issues.push(issue('SHORT_DESCRIPTION', 'Belastbare Beschreibung fehlt', 'CRITICAL'));
  }

  if (specCount >= 4) score += 15;
  else if (specCount >= 2) {
    score += 10;
    issues.push(issue('TOO_FEW_SPECS', 'Nur wenige technische Daten', 'WARNING'));
  } else {
    issues.push(issue('TOO_FEW_SPECS', 'Technische Daten fehlen', 'WARNING'));
  }

  if (input.hasImage) score += 10;
  else issues.push(issue('MISSING_IMAGE', 'Produktbild fehlt', 'WARNING'));

  if (sourceCount >= 3) score += 20;
  else if (sourceCount >= 2) score += 16;
  else if (sourceCount === 1) {
    score += 8;
    issues.push(issue('INSUFFICIENT_EVIDENCE', 'Nur eine unabhängige Quelle', 'CRITICAL'));
  } else if (experienceCount === 0) {
    issues.push(issue('INSUFFICIENT_EVIDENCE', 'Keine unabhängige Quelle', 'CRITICAL'));
  }

  if (experienceCount > 0) score += 10;
  score = Math.min(100, score);

  return {
    productId: input.productId,
    canonicalName: input.canonicalName,
    status: input.status,
    score,
    publishReady: nameOk && score >= 55 && (sourceCount >= 2 || experienceCount > 0),
    issues,
    sourceCount,
    experienceCount,
    createdAt: input.createdAt.toISOString(),
  };
}

function issue(
  code: CatalogQualityIssueDto['code'],
  label: string,
  severity: CatalogQualityIssueDto['severity'],
): CatalogQualityIssueDto {
  return { code, label, severity };
}

/** Count evidence by host, so multiple URLs from one site cannot inflate trust. */
export function countDistinctSourceDomains(urls: Iterable<string>): number {
  const domains = new Set<string>();
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      if (!hostname || hostname === 'localhost') continue;
      domains.add(hostname);
    } catch {
      // Invalid model output is not evidence.
    }
  }
  return domains.size;
}

function countSpecs(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).label === 'string' &&
      typeof (item as Record<string, unknown>).value === 'string',
  ).length;
}
