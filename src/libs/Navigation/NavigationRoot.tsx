import {DarkTheme, DefaultTheme, findFocusedRoute, getPathFromState, NavigationContainer} from '@react-navigation/native';
import type {NavigationState} from '@react-navigation/native';
import React, {useContext, useEffect, useMemo, useRef} from 'react';
import {ScrollOffsetContext} from '@components/ScrollOffsetContextProvider';
import useCurrentReportID from '@hooks/useCurrentReportID';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemePreference from '@hooks/useThemePreference';
import Firebase from '@libs/Firebase';
import {FSPage} from '@libs/Fullstory';
import Log from '@libs/Log';
import {hasCompletedGuidedSetupFlowSelector, wasInvitedToNewDotSelector} from '@libs/onboardingSelectors';
import shouldOpenLastVisitedPath from '@libs/shouldOpenLastVisitedPath';
import {getPathFromURL} from '@libs/Url';
import {updateLastVisitedPath} from '@userActions/App';
import {updateOnboardingLastVisitedPath} from '@userActions/Welcome';
import {getOnboardingInitialPath} from '@userActions/Welcome/OnboardingFlow';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import AppNavigator from './AppNavigator';
import {cleanPreservedNavigatorStates} from './AppNavigator/createSplitNavigator/usePreserveNavigatorState';
import getAdaptedStateFromPath from './helpers/getAdaptedStateFromPath';
import {isWorkspacesTabScreenName} from './helpers/isNavigatorName';
import {saveSettingsTabPathToSessionStorage, saveWorkspacesTabPathToSessionStorage} from './helpers/lastVisitedTabPathUtils';
import {linkingConfig} from './linkingConfig';
import Navigation, {navigationRef} from './Navigation';

type NavigationRootProps = {
    /** Whether the current user is logged in with an authToken */
    authenticated: boolean;

    /** Stores path of last visited page */
    lastVisitedPath: Route;

    /** Initial url */
    initialUrl: string | null;

    /** Fired when react-navigation is ready */
    onReady: () => void;
};

/**
 * Intercept navigation state changes and log it
 */
function parseAndLogRoute(state: NavigationState) {
    if (!state) {
        return;
    }

    const currentPath = getPathFromState(state, linkingConfig.config);

    const focusedRoute = findFocusedRoute(state);

    if (focusedRoute && !CONST.EXCLUDE_FROM_LAST_VISITED_PATH.includes(focusedRoute?.name)) {
        updateLastVisitedPath(currentPath);
        if (currentPath.startsWith(`/${ROUTES.ONBOARDING_ROOT.route}`)) {
            updateOnboardingLastVisitedPath(currentPath);
        }
    }

    // Don't log the route transitions from OldDot because they contain authTokens
    if (currentPath.includes('/transition')) {
        Log.info('Navigating from transition link from OldDot using short lived authToken');
    } else {
        Log.info('Navigating to route', false, {path: currentPath});
    }

    Navigation.setIsNavigationReady();
    if (isWorkspacesTabScreenName(state.routes.at(-1)?.name)) {
        saveWorkspacesTabPathToSessionStorage(currentPath);
    } else if (state.routes.at(-1)?.name === NAVIGATORS.SETTINGS_SPLIT_NAVIGATOR) {
        saveSettingsTabPathToSessionStorage(currentPath);
    }

    // Fullstory Page navigation tracking
    const focusedRouteName = focusedRoute?.name;
    if (focusedRouteName) {
        new FSPage(focusedRouteName, {path: currentPath}).start();
    }
}

function NavigationRoot({authenticated, lastVisitedPath, initialUrl, onReady}: NavigationRootProps) {
    const firstRenderRef = useRef(true);
    const themePreference = useThemePreference();
    const theme = useTheme();
    const {cleanStaleScrollOffsets} = useContext(ScrollOffsetContext);

    const currentReportIDValue = useCurrentReportID();
    const {shouldUseNarrowLayout} = useResponsiveLayout();

    const [account] = useOnyx(ONYXKEYS.ACCOUNT, {canBeMissing: true});
    const [isOnboardingCompleted = true] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {
        selector: hasCompletedGuidedSetupFlowSelector,
        canBeMissing: true,
    });
    const [wasInvitedToNewDot = false] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED, {
        selector: wasInvitedToNewDotSelector,
        canBeMissing: true,
    });
    const [hasNonPersonalPolicy] = useOnyx(ONYXKEYS.HAS_NON_PERSONAL_POLICY, {canBeMissing: true});
    const [currentOnboardingPurposeSelected] = useOnyx(ONYXKEYS.ONBOARDING_PURPOSE_SELECTED, {canBeMissing: true});
    const [currentOnboardingCompanySize] = useOnyx(ONYXKEYS.ONBOARDING_COMPANY_SIZE, {canBeMissing: true});
    const [onboardingInitialPath] = useOnyx(ONYXKEYS.ONBOARDING_LAST_VISITED_PATH, {canBeMissing: true});

    const previousAuthenticated = usePrevious(authenticated);

    const initialState = useMemo(() => {
        const path = initialUrl ? getPathFromURL(initialUrl) : null;
        if (path?.includes(ROUTES.MIGRATED_USER_WELCOME_MODAL.route) && shouldOpenLastVisitedPath(lastVisitedPath) && isOnboardingCompleted && authenticated) {
            Navigation.isNavigationReady().then(() => {
                Navigation.navigate(ROUTES.MIGRATED_USER_WELCOME_MODAL.getRoute());
            });

            return getAdaptedStateFromPath(lastVisitedPath, linkingConfig.config);
        }

        if (!account || account.isFromPublicDomain) {
            return;
        }

        const shouldShowRequire2FAPage = !!account?.needsTwoFactorAuthSetup && !account.requiresTwoFactorAuth;
        if (shouldShowRequire2FAPage) {
            return getAdaptedStateFromPath(ROUTES.REQUIRE_TWO_FACTOR_AUTH, linkingConfig.config);
        }

        const isTransitioning = path?.includes(ROUTES.TRANSITION_BETWEEN_APPS);

        // If the user haven't completed the flow, we want to always redirect them to the onboarding flow.
        // We also make sure that the user is authenticated, isn't part of a group workspace, isn't in the transition flow & wasn't invited to NewDot.
        if (!CONFIG.IS_HYBRID_APP && !hasNonPersonalPolicy && !isOnboardingCompleted && !wasInvitedToNewDot && authenticated && !isTransitioning) {
            return getAdaptedStateFromPath(
                getOnboardingInitialPath({
                    isUserFromPublicDomain: !!account.isFromPublicDomain,
                    hasAccessiblePolicies: !!account.hasAccessibleDomainPolicies,
                    currentOnboardingPurposeSelected,
                    currentOnboardingCompanySize,
                    onboardingInitialPath,
                }),
                linkingConfig.config,
            );
        }

        // If there is no lastVisitedPath, we can do early return. We won't modify the default behavior.
        // The same applies to HybridApp, as we always define the route to which we want to transition.
        if (!shouldOpenLastVisitedPath(lastVisitedPath) || CONFIG.IS_HYBRID_APP) {
            return undefined;
        }

        // If the user opens the root of app "/" it will be parsed to empty string "".
        // If the path is defined and different that empty string we don't want to modify the default behavior.
        if (path) {
            return;
        }

        // Otherwise we want to redirect the user to the last visited path.
        return getAdaptedStateFromPath(lastVisitedPath, linkingConfig.config);

        // The initialState value is relevant only on the first render.
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);

    // https://reactnavigation.org/docs/themes
    const navigationTheme = useMemo(() => {
        const defaultNavigationTheme = themePreference === CONST.THEME.DARK ? DarkTheme : DefaultTheme;

        return {
            ...defaultNavigationTheme,
            colors: {
                ...defaultNavigationTheme.colors,
                background: theme.appBG,
            },
        };
    }, [theme.appBG, themePreference]);

    useEffect(() => {
        if (firstRenderRef.current) {
            // we don't want to make the report back button go back to LHN if the user
            // started on the small screen so we don't set it on the first render
            // making it only work on consecutive changes of the screen size
            firstRenderRef.current = false;
            return;
        }

        // After resizing the screen from wide to narrow, if we have visited multiple central screens, we want to go back to the LHN screen, so we set shouldPopToSidebar to true.
        // Now when this value is true, Navigation.goBack with the option {shouldPopToTop: true} will remove all visited central screens in the given tab from the navigation stack and go back to the LHN.
        // More context here: https://github.com/Expensify/App/pull/59300
        if (!shouldUseNarrowLayout) {
            return;
        }

        Navigation.setShouldPopToSidebar(true);
    }, [shouldUseNarrowLayout]);

    useEffect(() => {
        // Since the NAVIGATORS.REPORTS_SPLIT_NAVIGATOR url is "/" and it has to be used as an URL for SignInPage,
        // this navigator should be the only one in the navigation state after logout.
        const hasUserLoggedOut = !authenticated && !!previousAuthenticated;
        if (!hasUserLoggedOut || !navigationRef.isReady()) {
            return;
        }

        const rootState = navigationRef.getRootState();
        const lastRoute = rootState.routes.at(-1);
        if (!lastRoute) {
            return;
        }

        // REPORTS_SPLIT_NAVIGATOR will persist after user logout, because it is used both for logged-in and logged-out users
        // That's why for ReportsSplit we need to explicitly clear params when resetting navigation state,
        // However in case other routes (related to login/logout) appear in nav state, then we want to preserve params for those
        const isReportSplitNavigatorMounted = lastRoute.name === NAVIGATORS.REPORTS_SPLIT_NAVIGATOR;
        navigationRef.reset({
            ...rootState,
            index: 0,
            routes: [
                {
                    ...lastRoute,
                    params: isReportSplitNavigatorMounted ? undefined : lastRoute.params,
                },
            ],
        });
    }, [authenticated, previousAuthenticated]);

    const handleStateChange = (state: NavigationState | undefined) => {
        if (!state) {
            return;
        }
        const currentRoute = navigationRef.getCurrentRoute();
        Firebase.log(`[NAVIGATION] screen: ${currentRoute?.name}, params: ${JSON.stringify(currentRoute?.params ?? {})}`);

        // Performance optimization to avoid context consumers to delay first render
        setTimeout(() => {
            currentReportIDValue?.updateCurrentReportID(state);
        }, 0);
        parseAndLogRoute(state);

        // We want to clean saved scroll offsets for screens that aren't anymore in the state.
        cleanStaleScrollOffsets(state);
        cleanPreservedNavigatorStates(state);
    };

    return (
        <NavigationContainer
            initialState={initialState}
            onStateChange={handleStateChange}
            onReady={onReady}
            theme={navigationTheme}
            ref={navigationRef}
            linking={linkingConfig}
            documentTitle={{
                enabled: false,
            }}
        >
            <AppNavigator authenticated={authenticated} />
        </NavigationContainer>
    );
}

NavigationRoot.displayName = 'NavigationRoot';

export default NavigationRoot;
