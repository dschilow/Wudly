import { type PipeTransform, BadRequestException } from '@nestjs/common';
import { type ZodSchema, ZodError } from 'zod';

/**
 * A PipeTransform that validates/parses input against a Zod schema.
 *
 * Usage:
 *   @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput
 *
 * Keeping validation in Zod (shared with the frontend via @wudly/shared) means a
 * single contract definition drives both client types and server validation.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: err.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`),
          error: 'Validation Failed',
        });
      }
      throw err;
    }
  }
}
