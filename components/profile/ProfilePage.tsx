"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProfile, AuthUser, LearningProgress, CloudProject } from "@/lib/auth-types";
import { getCurrentUser, getProfile, updateProfile, logoutUser, getProgress, getProjects } from "@/lib/auth-api";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, LogOut, Save, User as UserIcon, BookOpen, FolderOpen, Award, CheckCircle2 } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [institution, setInstitution] = useState("");
  const [bio, setBio] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [preferredSdk, setPreferredSdk] = useState("");
  const [learningGoal, setLearningGoal] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        const currentProfile = await getProfile();
        setProfile(currentProfile);
        
        // initialize form
        setFullName(currentProfile.full_name || "");
        setUserRole(currentProfile.user_role || "");
        setInstitution(currentProfile.institution || "");
        setBio(currentProfile.bio || "");
        setExperienceLevel(currentProfile.experience_level || "");
        setPreferredSdk(currentProfile.preferred_sdk || "");
        setLearningGoal(currentProfile.learning_goal || "");
        
        // load stats
        const prog = await getProgress();
        setProgress(prog);
        const projs = await getProjects();
        setProjects(projs);
        
      } catch (err: any) {
        if (err.message.includes("401") || err.message.includes("Credentials") || err.message.includes("Not authenticated")) {
          router.replace("/login?next=/profile");
        } else {
          setError(err.message || "Failed to load profile");
        }
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const updated = await updateProfile({
        full_name: fullName,
        user_role: userRole,
        institution: institution,
        bio: bio,
        experience_level: experienceLevel,
        preferred_sdk: preferredSdk,
        learning_goal: learningGoal,
      });
      setProfile(updated);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    logoutUser();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Could not load profile"}</p>
          <button onClick={() => window.location.reload()} className="text-primary hover:underline">Try again</button>
        </div>
      </div>
    );
  }
  
  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "?";
    
  const completedModules = progress.filter(p => p.completed).length;
  const joinedDate = new Date(profile.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

  return (
    <div className="mx-auto max-w-5xl p-5 sm:p-8">
      <Toaster />
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column: Stats & Identity */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className="glass p-6 rounded-2xl flex flex-col items-center text-center">
            <div className="grid size-24 place-items-center rounded-full bg-primary/20 text-3xl font-bold text-primary mb-4 border-2 border-primary/40 shadow-[0_0_20px_rgba(187,143,255,.2)]">
              {initials}
            </div>
            <h2 className="text-xl font-bold text-foreground">{profile.full_name}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              <Award className="size-3" /> {profile.xp} XP
            </div>
          </div>
          
          <div className="glass p-6 rounded-2xl">
            <h3 className="font-semibold mb-4 text-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" /> Activity
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><BookOpen className="size-4" /> Modules</span>
                <span className="font-medium">{completedModules}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><FolderOpen className="size-4" /> Projects</span>
                <span className="font-medium">{projects.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Joined</span>
                <span className="font-medium">{joinedDate}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleSignOut}
            className="w-full flex justify-center items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/20 transition"
          >
            <LogOut className="size-4" /> Sign Out
          </button>
        </div>

        {/* Right Column: Edit Form */}
        <div className="w-full md:w-2/3">
          <div className="glass p-6 sm:p-8 rounded-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserIcon className="size-5 text-primary" /> Profile Settings
            </h2>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <select 
                    value={userRole} 
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 appearance-none"
                  >
                    <option value="Student">Student</option>
                    <option value="Researcher">Researcher</option>
                    <option value="Professional">Professional</option>
                    <option value="Hobbyist">Hobbyist</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Institution / Company (Optional)</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Biography (Optional)</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 resize-none"
                  placeholder="Share a bit about your quantum journey..."
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-5 pt-2 border-t border-border/50 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Experience Level</label>
                  <select 
                    value={experienceLevel} 
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 appearance-none"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preferred SDK</label>
                  <select 
                    value={preferredSdk} 
                    onChange={(e) => setPreferredSdk(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 appearance-none"
                  >
                    <option value="Qiskit">Qiskit</option>
                    <option value="Cirq">Cirq</option>
                    <option value="OpenQASM">OpenQASM</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary Learning Goal (Optional)</label>
                <input
                  type="text"
                  value={learningGoal}
                  onChange={(e) => setLearningGoal(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                  placeholder="E.g. Master VQE, learn Shor's algorithm..."
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(187,143,255,.2)] transition hover:shadow-[0_0_30px_rgba(187,143,255,.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
