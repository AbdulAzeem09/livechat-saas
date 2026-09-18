import { extname } from "node:path";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { FileStorageService } from "./file-storage.service";

// Types safe to render inline. Everything else (HTML, SVG, scripts...) downloads as an
// attachment so an uploaded file can't run script on the API origin.
const INLINE_CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp"
};

@ApiTags("Files")
@Controller("files")
export class FilesController {
  constructor(private readonly storage: FileStorageService) {}

  @Get(":organizationId/:key")
  @ApiOperation({ summary: "Serve an uploaded attachment by storage key" })
  async serve(
    @Param("organizationId") organizationId: string,
    @Param("key") key: string,
    @Res() response: Response
  ): Promise<void> {
    const stream = await this.storage.open(organizationId, key);

    if (!stream) {
      throw new NotFoundException("File not found");
    }

    const inlineType = INLINE_CONTENT_TYPES[extname(key).toLowerCase()];

    // Attachments are embedded cross-origin (widget + dashboard), so relax CORP.
    response.setHeader("cross-origin-resource-policy", "cross-origin");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("cache-control", "private, max-age=86400");
    response.setHeader("content-type", inlineType ?? "application/octet-stream");
    if (!inlineType) {
      response.setHeader("content-disposition", "attachment");
    }

    stream.on("error", () => {
      if (response.headersSent) {
        response.destroy();
      } else {
        response.status(500).end();
      }
    });
    stream.pipe(response);
  }
}
