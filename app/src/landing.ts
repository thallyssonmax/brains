import {authCallback,paths} from './routes';
// Keep email links issued before the route change working, including recovery tokens.
if(authCallback(location.search,location.hash))location.replace(paths.login+location.search+location.hash);
