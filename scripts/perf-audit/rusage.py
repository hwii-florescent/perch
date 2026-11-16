"""Per-process CPU %, wakeups/s, energy (mW) and footprint over an interval, via proc_pid_rusage.

python3 -I rusage.py SECONDS PID[,PID...] [PID...]   (comma-joined pids are summed as one app)
"""
import ctypes, sys, time

lib = ctypes.CDLL("/usr/lib/libSystem.B.dylib")
U = ctypes.c_uint64
FIELDS = ["user", "system", "pkg_idle_wkups", "interrupt_wkups", "pageins", "wired", "resident",
          "footprint", "start", "exit", "cu", "cs", "cidle", "cint", "cpageins", "celapsed",
          "dread", "dwrite", "q0", "q1", "q2", "q3", "q4", "q5", "q6", "billed_sys", "serviced_sys",
          "logical_writes", "max_footprint", "instructions", "cycles", "billed_energy",
          "serviced_energy", "interval_max_footprint", "runnable"]


class RU(ctypes.Structure):
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [(f, U) for f in FIELDS]


class TB(ctypes.Structure):
    _fields_ = [("numer", ctypes.c_uint32), ("denom", ctypes.c_uint32)]


tb = TB(); lib.mach_timebase_info(ctypes.byref(tb))
TICK_NS = tb.numer / tb.denom


def read(pid):
    r = RU()
    if lib.proc_pid_rusage(int(pid), 4, ctypes.byref(r)) != 0:
        return None
    return r


def snap(groups):
    return {g: [read(p) for p in g.split(",")] for g in groups}


def main():
    secs = float(sys.argv[1]); groups = sys.argv[2:]
    a = snap(groups); t0 = time.monotonic()
    time.sleep(secs)
    b = snap(groups); dt = time.monotonic() - t0
    for g in groups:
        cpu = wk = idle = energy = fp = 0.0
        for x, y in zip(a[g], b[g]):
            if not x or not y:
                continue
            cpu += ((y.user + y.system) - (x.user + x.system)) * TICK_NS / 1e9
            wk += y.interrupt_wkups - x.interrupt_wkups
            idle += y.pkg_idle_wkups - x.pkg_idle_wkups
            energy += y.billed_energy - x.billed_energy
            fp += y.footprint
        print(f"{g}: cpu {100 * cpu / dt:.2f}% wakeups {wk / dt:.1f}/s pkg-idle {idle / dt:.1f}/s "
              f"energy {energy / dt / 1e6:.1f} mW footprint {fp / 1048576:.1f} MB")


main()
