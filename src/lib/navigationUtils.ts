import { NavigateFunction, Location } from 'react-router-dom';

export interface NavigationState {
  previousPath?: string;
  returnTo?: string;
}

export function navigateWithReturn(
  navigate: NavigateFunction,
  targetPath: string,
  currentLocation: Location
) {
  navigate(targetPath, {
    state: {
      previousPath: currentLocation.pathname + currentLocation.search,
      returnTo: currentLocation.pathname + currentLocation.search
    }
  });
}

export function navigateBack(
  navigate: NavigateFunction,
  location: Location,
  defaultPath?: string
) {
  const state = location.state as NavigationState | null;

  if (state?.previousPath) {
    navigate(state.previousPath, { replace: true });
  } else if (state?.returnTo) {
    navigate(state.returnTo, { replace: true });
  } else if (defaultPath) {
    navigate(defaultPath, { replace: true });
  } else {
    navigate(-1);
  }
}

export function getReturnPath(location: Location, defaultPath: string): string {
  const state = location.state as NavigationState | null;
  return state?.previousPath || state?.returnTo || defaultPath;
}
