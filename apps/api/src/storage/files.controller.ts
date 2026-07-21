import { createReadStream, existsSync } from "node:fs";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { FileStorageService } from "./file-storage.service";

@ApiTags("Files")
@Controller("files")
export class FilesController {
  constructor(private readonly storage: FileStorageService) {}

  @Get(":organizationId/:key")
  @ApiOperation({ summary: "Serve an uploaded attachment by storage key" })
  serve(
    @Param("organizationId") organizationId: string,
    @Param("key") key: string,
    @Res() response: Response
  ): void {
    const path = this.storage.resolvePath(organizationId, key);

    if (!path || !existsSync(path)) {
      throw new NotFoundException("File not found");
    }

    // Attachments are embedded cross-origin (widget + dashboard), so relax CORP.
    response.setHeader("cross-origin-resource-policy", "cross-origin");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("cache-control", "private, max-age=86400");

    createReadStream(path).pipe(response);
  }
}
