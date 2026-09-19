import { Global, Module } from "@nestjs/common";
import { EncryptionService } from "./encryption.service";

/** Global: anything that stores a third-party secret needs this. */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService]
})
export class EncryptionModule {}
