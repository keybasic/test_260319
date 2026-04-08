import Header from '../components/Header';
import ProblemCard from '../components/ProblemCard';
import { useProblems } from '../context/ProblemsContext';

function Home() {
  const { problems } = useProblems();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
             오늘의 기하 연습
          </h1>
          <p className="mt-1 text-slate-600">
            문제를 골라 정당화를 연습해 보세요.
          </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((card) => (
            <ProblemCard key={card.id} problem={card} />
          ))}
          {problems.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              아직 배포된 문제가 없습니다. 관리자 화면에서 새 문제를 만들어 주세요.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Home;
