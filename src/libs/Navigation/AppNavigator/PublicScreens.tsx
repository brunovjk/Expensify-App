import React from 'react';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import createPlatformStackNavigator from '@libs/Navigation/PlatformStackNavigation/createPlatformStackNavigator';
import {InternalPlatformAnimations} from '@libs/Navigation/PlatformStackNavigation/navigationOptions/animation';
import type {PublicScreensParamList} from '@navigation/types';
import ConnectionCompletePage from '@pages/ConnectionCompletePage';
import LogInWithShortLivedAuthTokenPage from '@pages/LogInWithShortLivedAuthTokenPage';
import AppleSignInDesktopPage from '@pages/signin/AppleSignInDesktopPage';
import GoogleSignInDesktopPage from '@pages/signin/GoogleSignInDesktopPage';
import SAMLSignInPage from '@pages/signin/SAMLSignInPage';
import SignInPage from '@pages/signin/SignInPage';
import UnlinkLoginPage from '@pages/UnlinkLoginPage';
import ValidateLoginPage from '@pages/ValidateLoginPage';
import NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';
import defaultScreenOptions from './defaultScreenOptions';
import PublicRightModalNavigator from './Navigators/PublicRightModalNavigator';
import TestToolsModalNavigator from './Navigators/TestToolsModalNavigator';
import useRootNavigatorScreenOptions from './useRootNavigatorScreenOptions';

const RootStack = createPlatformStackNavigator<PublicScreensParamList>();

function PublicScreens() {
    const rootNavigatorScreenOptions = useRootNavigatorScreenOptions();
    const theme = useTheme();
    const StyleUtils = useStyleUtils();
    return (
        <RootStack.Navigator screenOptions={defaultScreenOptions}>
            {/* The structure for the HOME route has to be the same in public and auth screens. That's why the name for SignInPage is REPORTS_SPLIT_NAVIGATOR. */}
            <RootStack.Screen
                name={NAVIGATORS.REPORTS_SPLIT_NAVIGATOR}
                options={defaultScreenOptions}
                component={SignInPage}
            />
            <RootStack.Screen
                name={SCREENS.TRANSITION_BETWEEN_APPS}
                component={LogInWithShortLivedAuthTokenPage}
            />
            <RootStack.Screen
                name={SCREENS.VALIDATE_LOGIN}
                options={defaultScreenOptions}
                component={ValidateLoginPage}
            />
            <RootStack.Screen
                name={SCREENS.CONNECTION_COMPLETE}
                component={ConnectionCompletePage}
            />
            <RootStack.Screen
                name={SCREENS.BANK_CONNECTION_COMPLETE}
                component={ConnectionCompletePage}
            />
            <RootStack.Screen
                name={SCREENS.UNLINK_LOGIN}
                component={UnlinkLoginPage}
            />
            <RootStack.Screen
                name={SCREENS.SIGN_IN_WITH_APPLE_DESKTOP}
                component={AppleSignInDesktopPage}
            />
            <RootStack.Screen
                name={SCREENS.SIGN_IN_WITH_GOOGLE_DESKTOP}
                component={GoogleSignInDesktopPage}
            />
            <RootStack.Screen
                name={SCREENS.SAML_SIGN_IN}
                component={SAMLSignInPage}
            />
            <RootStack.Screen
                name={NAVIGATORS.PUBLIC_RIGHT_MODAL_NAVIGATOR}
                component={PublicRightModalNavigator}
                options={rootNavigatorScreenOptions.rightModalNavigator}
            />
            <RootStack.Screen
                name={NAVIGATORS.TEST_TOOLS_MODAL_NAVIGATOR}
                options={{
                    ...rootNavigatorScreenOptions.basicModalNavigator,
                    native: {
                        contentStyle: {
                            ...StyleUtils.getBackgroundColorWithOpacityStyle(theme.overlay, 0.72),
                        },
                        animation: InternalPlatformAnimations.FADE,
                    },
                    web: {
                        cardStyle: {
                            ...StyleUtils.getBackgroundColorWithOpacityStyle(theme.overlay, 0.72),
                        },
                        animation: InternalPlatformAnimations.FADE,
                    },
                }}
                component={TestToolsModalNavigator}
            />
        </RootStack.Navigator>
    );
}

PublicScreens.displayName = 'PublicScreens';

export default PublicScreens;
