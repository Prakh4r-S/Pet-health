import { signOut } from "@/../auth";

export default function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button type="submit" className="text-sm text-gray-500 hover:underline">
        Sign out
      </button>
    </form>
  );
}
