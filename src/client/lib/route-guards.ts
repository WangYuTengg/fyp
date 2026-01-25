// Note: These guards can't access React context directly
// Instead, we'll check auth in the component or rely on client-side checks
export function requireAuth() {
  // Guard will be checked in component useEffect
  return () => {
    // Placeholder - actual auth check happens client-side
  };
}

export function requireRole(allowedRoles: string[]) {
  // Guard will be checked in component useEffect
  void allowedRoles;
  return () => {
    // Placeholder - actual role check happens client-side
  };
}

