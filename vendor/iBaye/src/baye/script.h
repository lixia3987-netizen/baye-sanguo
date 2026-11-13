//
//  script.h
//  baye-ios
//
//  Created by loong on 16/9/17.
//
//

#ifndef script_h
#define script_h

#include <stdio.h>
#include <inc/dictsys.h>
#include <baye/data-bind.h>

void script_init(void);
int has_hook(const char* name);
int call_hook_s(const char* name, Value* context);
int call_hook_a(const char* name, Value* context);
#ifdef __EMSCRIPTEN__
int call_hook_a_observed(const char* name, Value* context, U8* present);
#else
/* Other native script backends keep their existing dispatch. Their presence
 * cannot be observed by this Web bridge, so HD conservatively retains LCD. */
static inline int call_hook_a_observed(const char* name, Value* context, U8* present)
{
    if (present) *present = 1;
    return call_hook_a(name, context);
}
#endif
int call_script(const char*script);
#define call_hook call_hook_a

#endif /* script_h */
