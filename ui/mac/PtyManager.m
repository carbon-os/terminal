#import "PtyManager.h"
#import <wkwebview-ipc/IPC.h>
#import <util.h>        // forkpty
#import <termios.h>
#import <sys/ioctl.h>

// ── Per-session state ─────────────────────────────────────────────────────────

@interface PtySession : NSObject
@property (assign) pid_t              pid;
@property (assign) int                masterFd;
@property (strong) dispatch_source_t  readSource;
@end
@implementation PtySession @end

// ── Manager ───────────────────────────────────────────────────────────────────

@interface PtyManager ()
@property (strong) NSMutableDictionary<NSString *, PtySession *> *sessions;
@end

@implementation PtyManager

+ (instancetype)shared {
    static PtyManager *instance;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[PtyManager alloc] init]; });
    return instance;
}

- (instancetype)init {
    if (self = [super init])
        _sessions = [NSMutableDictionary dictionary];
    return self;
}

// ── Spawn ─────────────────────────────────────────────────────────────────────

- (void)spawnWithID:(NSString *)sessionID {
    struct winsize ws = { .ws_row = 24, .ws_col = 80 };
    int masterFd = -1;

    pid_t pid = forkpty(&masterFd, NULL, NULL, &ws);
    if (pid < 0) {
        NSLog(@"[pty] forkpty failed: %s", strerror(errno));
        return;
    }

    if (pid == 0) {
        // ── Child ────────────────────────────────────────────────────────────
        NSString *shell =
            NSProcessInfo.processInfo.environment[@"SHELL"] ?: @"/bin/zsh";
        setenv("TERM",         "xterm-256color", 1);
        setenv("TERM_PROGRAM", "CarbonTerminal", 1);
        execl(shell.UTF8String, shell.UTF8String, "-l", NULL);
        _exit(1);
    }

    // ── Parent ────────────────────────────────────────────────────────────────
    PtySession *session  = [[PtySession alloc] init];
    session.pid          = pid;
    session.masterFd     = masterFd;

    // Output: master fd → IPC stream → xterm.js
    dispatch_queue_t q = dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);
    dispatch_source_t src =
        dispatch_source_create(DISPATCH_SOURCE_TYPE_READ, masterFd, 0, q);

    dispatch_source_set_event_handler(src, ^{
        uint8_t buf[4096];
        ssize_t n = read(masterFd, buf, sizeof(buf));
        if (n > 0) {
            NSString *ch  = [@"pty." stringByAppendingString:sessionID];
            NSData   *out = [NSData dataWithBytes:buf length:(NSUInteger)n];
            [IPC send:ch data:out];
        } else {
            dispatch_source_cancel(src);
        }
    });

    dispatch_source_set_cancel_handler(src, ^{
        close(masterFd);
    });

    session.readSource          = src;
    self.sessions[sessionID]    = session;
    dispatch_resume(src);

    // Input: xterm.js keystrokes → master fd
    NSString *inCh = [NSString stringWithFormat:@"pty.%@.in", sessionID];
    [IPC on:inCh handler:^(NSData *data) {
        [self writeToSession:sessionID data:data];
    }];

    // Resize: cols/rows JSON → TIOCSWINSZ
    NSString *rzCh = [NSString stringWithFormat:@"pty.%@.resize", sessionID];
    [IPC on:rzCh handler:^(NSData *data) {
        NSDictionary *json =
            [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        [self resizeSession:sessionID
                       cols:[json[@"cols"] intValue]
                       rows:[json[@"rows"] intValue]];
    }];
}

// ── Write ─────────────────────────────────────────────────────────────────────

- (void)writeToSession:(NSString *)sessionID data:(NSData *)data {
    PtySession *s = self.sessions[sessionID];
    if (!s) return;
    write(s.masterFd, data.bytes, data.length);
}

// ── Resize ────────────────────────────────────────────────────────────────────

- (void)resizeSession:(NSString *)sessionID cols:(int)cols rows:(int)rows {
    PtySession *s = self.sessions[sessionID];
    if (!s || cols <= 0 || rows <= 0) return;
    struct winsize ws = { .ws_row = (unsigned short)rows,
                          .ws_col = (unsigned short)cols };
    ioctl(s.masterFd, TIOCSWINSZ, &ws);
}

// ── Kill ──────────────────────────────────────────────────────────────────────

- (void)killSession:(NSString *)sessionID {
    PtySession *s = self.sessions[sessionID];
    if (!s) return;
    dispatch_source_cancel(s.readSource);
    kill(s.pid, SIGHUP);
    [self.sessions removeObjectForKey:sessionID];
}

@end