import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { DiceIcon, UsersIcon } from "./icons";

export function Navigation() {
  return (
    <nav className="fixed w-full bg-black/20 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center">
              <DiceIcon className="w-8 h-8" />
              <span className="ml-2 text-xl font-bold">D&D Inventory</span>
            </Link>
            
            <SignedIn>
              <div className="flex items-center space-x-4">
                <Link 
                  to="/friends" 
                  className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                >
                  <UsersIcon className="w-5 h-5" />
                  <span>Friends</span>
                </Link>
              </div>
            </SignedIn>
          </div>

          <div className="flex items-center space-x-4">
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
}