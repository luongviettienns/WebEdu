import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EMAIL_PROVIDER } from './mail.types.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';
import { MailService } from './mail.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: SmtpEmailProvider,
    },
    MailService,
  ],
  exports: [EMAIL_PROVIDER, MailService],
})
export class MailModule {}
