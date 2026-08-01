// @public
"use server";

import { errorMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import {
  schemaActionInputForgotPassword,
  type ActionInputForgotPassword,
  type ActionOutputForgotPassword,
} from "./forgot-password-action-dto";
import { serviceRequestPasswordReset } from "./forgot-password-service";
import { recordAuthEvent } from "@/modules/auth-event/auth-event-service";
import { AUTH_EVENT_ACTIONS } from "@/modules/auth-event/auth-event-actions";

const log = createLogger("forgot-password-action");

// @public
export async function actionRequestPasswordReset(
  input: unknown
): Promise<ActionOutputForgotPassword> {
  try {
    const dto = schemaActionInputForgotPassword.parse(input) as ActionInputForgotPassword;

    const result = await serviceRequestPasswordReset({ email: dto.email });
    if (result.success) {
      await recordAuthEvent({
        userId: null,
        action: AUTH_EVENT_ACTIONS.PASSWORD_RESET_REQUEST,
        entityType: "user",
        metadata: { email: dto.email },
      });
    }
    return result;
  } catch (e) {
    log.error("Password reset request failed", { error: errorMessage(e) });
    return {
      success: false,
      message: "发送重置邮件失败，请稍后重试",
    };
  }
}
