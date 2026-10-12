import { Controller, Get } from '@nestjs/common';
import { systemInfoSchema } from '@tandara/contracts';
import { buildOpenApiDocument } from './openapi.js';

@Controller('/api/v1/system')
export class SystemController {
  @Get('/info')
  info() {
    return systemInfoSchema.parse({ name: 'Tandara', mode: 'simulation', stage: 'foundation' });
  }

  @Get('/openapi.json')
  openapi() {
    return buildOpenApiDocument();
  }
}
