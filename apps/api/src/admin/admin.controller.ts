import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { MergeCandidateDto } from '@wudly/shared';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('merge-candidates')
  listMergeCandidates(): Promise<MergeCandidateDto[]> {
    return this.admin.listMergeCandidates('PENDING');
  }

  @Post('merge-candidates/:id/merge')
  @HttpCode(HttpStatus.OK)
  merge(@Param('id') id: string): Promise<{ canonicalProductId: string }> {
    return this.admin.merge(id);
  }

  @Post('merge-candidates/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string): Promise<{ success: true }> {
    return this.admin.reject(id);
  }
}
