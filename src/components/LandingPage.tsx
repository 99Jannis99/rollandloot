import { SignInButton } from "@clerk/clerk-react";
import { ScrollIcon, UsersIcon, ShieldIcon } from "./icons";
import { FeatureCard } from "./FeatureCard";

export function LandingPage() {
  return (
    <div className="text-center">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-violet-400 to-purple-400 text-transparent bg-clip-text">
        Manage Your D&D Adventure
      </h1>
      <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
        Keep track of your inventory, manage your party, and enhance your roleplaying experience with our digital companion.
      </p>
      
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <FeatureCard 
          icon={<ScrollIcon className="w-8 h-8" />}
          title="Digital Inventory"
          description="Track your items, weapons, and treasures with ease"
        />
        <FeatureCard 
          icon={<UsersIcon className="w-8 h-8" />}
          title="Party Management"
          description="Coordinate with your fellow adventurers"
        />
        <FeatureCard 
          icon={<ShieldIcon className="w-8 h-8" />}
          title="DM Tools"
          description="Special features for Dungeon Masters"
        />
      </div>

      <SignInButton mode="modal">
        <button className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors">
          Start Your Adventure
        </button>
      </SignInButton>
    </div>
  );
}