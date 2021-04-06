#ifndef _AES_H_
#define _AES_H_

#include <stdint.h>
#include <stddef.h>
#include <emscripten/emscripten.h>

// #define the macros below to 1/0 to enable/disable the mode of operation.
// The #ifndef-guard allows it to be configured before #include'ing or at compile time.

#ifndef ECB
  #define ECB 1
#endif

#ifndef CBC
  #define CBC 1
#endif

#ifndef CFB
  #define CFB 1
#endif

#ifndef OFB
  #define OFB 1
#endif

#ifndef CTR
  #define CTR 1
#endif

#ifndef AES256
  #ifndef AES192
    #ifndef AES128
      #define AES128 1
    #endif
    // #define AES192 1
  #endif
  // #define AES256 1
#endif

#define AES_BLOCKLEN 16 // Block length in bytes - AES is 128b block only

#if defined(AES256) && (AES256 == 1)
    #define AES_KEYLEN 32
    #define AES_KEYEXPSIZE 240
#elif defined(AES192) && (AES192 == 1)
    #define AES_KEYLEN 24
    #define AES_KEYEXPSIZE 208
#elif defined(AES128) && (AES128 == 1)
    #define AES_KEYLEN 16   // Key length in bytes
    #define AES_KEYEXPSIZE 176
#endif

struct AES_ctx
{
  uint8_t RoundKey[AES_KEYEXPSIZE];
#if (defined(CBC) && (CBC == 1)) || (defined(CFB) && (CFB == 1)) || (defined(OFB) && (OFB == 1)) || (defined(CTR) && (CTR == 1))
  uint8_t Iv[AES_BLOCKLEN];
#endif
};

EMSCRIPTEN_KEEPALIVE
void AES_init_ctx(struct AES_ctx* ctx, const uint8_t* key);
#if (defined(CBC) && (CBC == 1)) || (defined(CFB) && (CFB == 1)) || (defined(OFB) && (OFB == 1)) || (defined(CTR) && (CTR == 1))
EMSCRIPTEN_KEEPALIVE
void AES_init_ctx_iv(struct AES_ctx* ctx, const uint8_t* key, const uint8_t* iv);
EMSCRIPTEN_KEEPALIVE
void AES_ctx_set_iv(struct AES_ctx* ctx, const uint8_t* iv);
#endif

#if defined(ECB) && (ECB == 1)
EMSCRIPTEN_KEEPALIVE
void AES_ECB_encrypt(const struct AES_ctx* ctx, uint8_t* buf);
EMSCRIPTEN_KEEPALIVE
void AES_ECB_decrypt(const struct AES_ctx* ctx, uint8_t* buf);
#endif // #if defined(ECB) && (ECB == !)

#if defined(CBC) && (CBC == 1)
EMSCRIPTEN_KEEPALIVE
void AES_CBC_encrypt_buffer(struct AES_ctx* ctx, uint8_t* buf, size_t length);
EMSCRIPTEN_KEEPALIVE
void AES_CBC_decrypt_buffer(struct AES_ctx* ctx, uint8_t* buf, size_t length);
#endif // #if defined(CBC) && (CBC == 1)

#if defined(CFB) && (CFB == 1)
EMSCRIPTEN_KEEPALIVE
void AES_CFB_encrypt_buffer(struct AES_ctx* ctx, uint8_t* buf, size_t length);
EMSCRIPTEN_KEEPALIVE
void AES_CFB_decrypt_buffer(struct AES_ctx* ctx, uint8_t* buf, size_t length);
#endif // #if defined(CFB) && (CFB == 1)

#if defined(OFB) && (OFB == 1)
EMSCRIPTEN_KEEPALIVE
void AES_OFB_xcrypt_buffer(struct AES_ctx* ctx, uint8_t* buf, size_t length);
#endif // #if defined(OFB) && (OFB == 1)

#if defined(CTR) && (CTR == 1)
EMSCRIPTEN_KEEPALIVE
void AES_CTR_xcrypt_buffer(struct AES_ctx* ctx, uint8_t* buf, size_t length);
#endif // #if defined(CTR) && (CTR == 1)

#endif // _AES_H_
