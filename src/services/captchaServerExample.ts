/**
 * 本项目（纯前端 console）不包含任何后端验证码验签逻辑。
 *
 * 阿里云 Captcha 2.0 的“安全风控验签”在官方模型里必须由服务端调用
 * VerifyIntelligentCaptcha（需要 AccessKey Secret）。
 *
 * 如果把验签放在前端，会不可避免地泄露密钥，从而失去安全意义。
 */

export {};
