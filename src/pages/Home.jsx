import Header from '../components/Header';
import ProblemCard from '../components/ProblemCard';
import { problemCards } from '../data/mockData';

function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            📚 오늘의 기하 연습
          </h1>
          <p className="mt-1 text-slate-600">
            문제를 골라 정당화를 연습해 보세요.
          </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problemCards.map((card) => (
            <ProblemCard key={card.id} problem={card} />
          ))}
        </section>
      </main>
    </div>
  );
}

export default Home;
